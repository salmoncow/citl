# ------------------------------------------------------------------------------
# S3 remote state backend
# ------------------------------------------------------------------------------

terraform {
  backend "s3" {
    bucket  = "citl"
    key     = "terraform_state/citl.tfstate"
    region  = "us-east-1"
    profile = "default"
  }
}
