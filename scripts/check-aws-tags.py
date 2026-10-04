#!/usr/bin/env python3
"""Fail if a taggable resource in infra/aws/*.yaml lacks the standard tags (ADR-015).

Every resource type in a template must be listed in TAG_PROPERTY: the property that
carries its tags, or None for types AWS can't tag. An unlisted type fails, so a new
resource is classified when it is added. Run in CI's Infrastructure Lint job (needs
cfn-lint, whose decoder reads the CloudFormation short-form tags).
"""

import glob
import sys

from cfnlint.decode import decode

REQUIRED = {
    'project': 'citl',
    'repo': 'github.com/salmoncow/citl',
    'managed-by': 'cloudformation',
}

TAG_PROPERTY = {
    'AWS::SES::ConfigurationSet': 'Tags',
    'AWS::SES::EmailIdentity': 'Tags',
    'AWS::IAM::Role': 'Tags',
    'AWS::Budgets::Budget': 'ResourceTags',
    'AWS::Route53::RecordSet': None,  # records can't be tagged; the hosted zone is not in a stack
}


def check(path: str) -> list[str]:
    template, matches = decode(path)
    if matches:
        return [f'{path}: could not parse ({matches[0].message})']
    errors = []
    source = path.replace('\\', '/')
    for name, res in template.get('Resources', {}).items():
        rtype = res.get('Type')
        if rtype not in TAG_PROPERTY:
            errors.append(f'{path}: {name} ({rtype}) is not classified in {__file__} TAG_PROPERTY')
            continue
        prop = TAG_PROPERTY[rtype]
        if prop is None:
            continue
        tags = {t.get('Key'): t.get('Value') for t in res.get('Properties', {}).get(prop, []) or []}
        expected = {**REQUIRED, 'source': source}
        for key, value in expected.items():
            if tags.get(key) != value:
                errors.append(f'{path}: {name} needs tag {key}={value} (has {tags.get(key)!r})')
        if not tags.get('decision'):
            errors.append(f'{path}: {name} needs a decision tag (the ADR or spec that justifies it)')
    return errors


def main() -> int:
    paths = sorted(glob.glob('infra/aws/*.yaml'))
    if not paths:
        print('no templates under infra/aws/')
        return 1
    errors = [e for p in paths for e in check(p)]
    for e in errors:
        print(e)
    if not errors:
        print(f'tags ok: {", ".join(paths)}')
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
