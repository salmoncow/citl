# AWS Infrastructure

**Owner**: Tyler (deploys); changes by PR
**Decision**: [ADR-015](../../.prompts/meta/architectural-decision-log.md) · constitution §I.2, §III.2, §IV.1, §IV.2
**Region**: `us-east-1`

AWS hosts two things for citl.club: the `citl.club` DNS zone (Route 53) and league email
(SES, spec 011). Everything except the items under [Manual actions](#manual-actions) is
CloudFormation in `infra/aws/`.

---

## Stacks

| Stack | Template | Resources |
|-------|----------|-----------|
| `citl-mail` | [`infra/aws/ses.yaml`](../../infra/aws/ses.yaml) | SES identity `mail.citl.club` (DKIM 2048-bit, MAIL FROM `bounce.mail.citl.club`); configuration set `citl-mail` (bounce/complaint suppression); 6 Route 53 records (3 DKIM CNAME, MAIL FROM MX + SPF, DMARC); IAM role `citl-ses-sender`; SES budget alert; optional sandbox test identity |

### How the function authenticates

`sendMail` runs as the Firebase Functions runtime service account
(`{projectNumber}-compute@developer.gserviceaccount.com`). It fetches a Google-signed ID
token from the metadata server and calls `sts:AssumeRoleWithWebIdentity` for
`citl-ses-sender`. AWS accepts `accounts.google.com` tokens natively; the role trusts only
that service account's numeric ID (`aud` and `sub`) and may only `ses:SendEmail` from
`news@mail.citl.club`. Credentials last one hour. No AWS keys exist.

Accepted risk: every gen2 function in `citl-baed2` runs as the same service account, so any
of them could assume the role. All of them are this repo's code; a dedicated service
account would add a CI permission grant for little gain at this size.

---

## Change process

1. Edit the template in a PR. CI runs `cfn-lint infra/aws/*.yaml`.
2. After merge, the owner deploys from `main`. `deploy` keeps the previous value of any
   parameter not given, and `--no-execute-changeset` shows the change set first:
   ```bash
   aws cloudformation deploy --region us-east-1 --stack-name citl-mail \
     --template-file infra/aws/ses.yaml --capabilities CAPABILITY_NAMED_IAM \
     --no-execute-changeset
   # review the printed change set, then run the execute-change-set command it prints
   ```
3. Never change a template-owned resource in the console. If something drifted, fix the
   template and redeploy.

Quarterly (constitution §VIII.1):
```bash
aws cloudformation detect-stack-drift --region us-east-1 --stack-name citl-mail
aws cloudformation describe-stack-resource-drifts --region us-east-1 --stack-name citl-mail \
  --stack-resource-drift-status-filters MODIFIED DELETED
```

---

## First deploy (owner)

Prerequisites: AWS CLI v2 signed in to the league account with admin rights;
`gcloud` signed in to `citl-baed2`.

```bash
# 1. Inputs
ZONE_ID=$(aws route53 list-hosted-zones-by-name --dns-name citl.club \
  --query 'HostedZones[0].Id' --output text | sed 's#/hostedzone/##')
PROJECT_NUMBER=$(gcloud projects describe citl-baed2 --format='value(projectNumber)')
SA_ID=$(gcloud iam service-accounts describe \
  "${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" --format='value(uniqueId)')

# 2. Stack (SandboxTestRecipient: your address, for testing before production access)
aws cloudformation deploy --region us-east-1 --stack-name citl-mail \
  --template-file infra/aws/ses.yaml --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides HostedZoneId="$ZONE_ID" GoogleServiceAccountId="$SA_ID" \
    AlertEmail=you@example.com SandboxTestRecipient=you@example.com
aws cloudformation update-termination-protection --region us-east-1 \
  --stack-name citl-mail --enable-termination-protection

# 3. Outputs (SenderRoleArn becomes the Functions parameter SES_ROLE_ARN)
aws cloudformation describe-stacks --region us-east-1 --stack-name citl-mail \
  --query 'Stacks[0].Outputs'

# 4. Check verification (DKIM SUCCESS, MAIL FROM SUCCESS; usually minutes)
aws sesv2 get-email-identity --region us-east-1 --email-identity mail.citl.club \
  --query '{dkim:DkimAttributes.Status,mailFrom:MailFromAttributes.MailFromDomainStatus,verified:VerifiedForSendingStatus}'
```

Confirm the verification email SES sends to `SandboxTestRecipient`, and the AWS Budgets
subscription email if one arrives.

---

## Manual actions

Actions with no CloudFormation resource. Each is done once and recorded here.

| Action | When | Command |
|--------|------|---------|
| Route 53 hosted zone `citl.club` | Pre-existing (before ADR-015) | Not managed by a stack; the template only adds records |
| SES production access | After the identity verifies | Below |

```bash
aws sesv2 put-account-details --region us-east-1 \
  --production-access-enabled --mail-type TRANSACTIONAL \
  --website-url https://citl.club --contact-language EN \
  --use-case-description "Central Illinois Trap League (citl.club), a volunteer trap shooting league of about 150 adult members. Members sign in on the site and opt in per topic to: weekly results when a week is published, schedule changes, and league announcements (about 40 sends per season to under 150 recipients). Members also receive one-off emails when the coordinator decides a request they submitted. Every topic email has a one-click unsubscribe (RFC 8058) handled on citl.club. Bounces and complaints are suppressed through an SES configuration set. Expected volume: under 5,000 emails per season."
```

AWS replies by email, usually within a day. Until then SES sends only to verified addresses.
Once granted, redeploy with `SandboxTestRecipient=''` to remove the test identity.

---

## Cost

SES: $0.10 per 1,000 emails (about $0.40 per season). Route 53: $0.50/month for the zone
plus queries. The `citl-ses-monthly` budget alerts above $1/month (actual or forecast).
