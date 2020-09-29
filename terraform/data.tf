# ------------------------------------------------------------------------------
# data, variables, locals, etc.
# ------------------------------------------------------------------------------

data "aws_caller_identity" "current" {}
data "aws_iam_account_alias" "current" {}

output "account_id" { value = data.aws_caller_identity.current.account_id }
output "account_alias" { value = data.aws_iam_account_alias.current.account_alias }

locals {
  region   = "us-east-1"
  ou       = "dev"
  use_case = "td000"

  tags = {
    "deployment" = "terraform"
    "owner"      = "citl"
    "use_case"   = local.use_case
  }
}
