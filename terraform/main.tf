# ------------------------------------------------------------------------------
# S3: Buckets
# ------------------------------------------------------------------------------

# citl.club (website host)
module "s3_bucket_citl_club" {
    source = "git::https://github.com/tdeknecht/aws-terraform//modules/storage/s3/s3_bucket/"
  # source = "../../aws/terraform/modules/storage/s3/s3_bucket"

  ou                            = local.ou
  use_case                      = local.use_case
  bucket                        = "citl.club"
  versioning                    = true
  base_lifecycle_rule           = true
  policy                        = data.aws_iam_policy_document.s3_bucket_policy_citl_club.json
  tags                          = local.tags

  # website config
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
  index_document          = "index.html"
  error_document          = "error.html"
}

output "s3_citl_club_id" { value = module.s3_bucket_citl_club.id }
output "s3_citl_club_arn" { value = module.s3_bucket_citl_club.arn }

data "aws_iam_policy_document" "s3_bucket_policy_citl_club" {
  statement {
    sid       = "publicRead"
    actions   = ["s3:GetObject"]
    resources = ["arn:aws:s3:::citl.club/*"]
    effect    = "Allow"
    principals {
      type        = "*"
      identifiers = ["*"]
    }
  }
}

# www.citl.club (website redirect)
module "s3_bucket_www_citl_club" {
    source = "git::https://github.com/tdeknecht/aws-terraform//modules/storage/s3/s3_bucket/"
  # source = "../../aws/terraform/modules/storage/s3/s3_bucket"

  ou                            = local.ou
  use_case                      = local.use_case
  bucket                        = "www.citl.club"
  versioning                    = false
  base_lifecycle_rule           = false
  tags                          = local.tags

  # website config
  redirect_all_requests_to = "https://citl.club"
}

# citl (data)
module "s3_bucket_citl" {
    source = "git::https://github.com/tdeknecht/aws-terraform//modules/storage/s3/s3_bucket/"
  # source = "../../aws/terraform/modules/storage/s3/s3_bucket"

  ou                            = local.ou
  use_case                      = local.use_case
  bucket                        = "citl"
  versioning                    = false
  base_lifecycle_rule           = true
  policy                        = data.aws_iam_policy_document.s3_bucket_policy_citl.json
  tags                          = local.tags
}

data "aws_iam_policy_document" "s3_bucket_policy_citl" {
  statement {
    sid       = "citl"
    actions   = ["s3:*"]
    resources = ["arn:aws:s3:::citl/*"]
    principals {
      type        = "AWS"
      identifiers = [data.aws_caller_identity.current.account_id]
    }
  }
}
