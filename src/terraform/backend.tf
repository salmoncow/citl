# ------------------------------------------------------------------------------
# S3 remote state backend
# ------------------------------------------------------------------------------

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 3.55.0"
    }
  }

  backend "s3" {
    bucket  = "citl"
    key     = "terraform_state/citl.tfstate"
    region  = "us-east-1"
    profile = "default"
  }
}
