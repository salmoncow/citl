# ------------------------------------------------------------------------------
# Route 53
# ------------------------------------------------------------------------------

# cit.club
module "route53_zone_citl_club" {
  source = "git::https://github.com/tdeknecht/aws-terraform//modules/network/route53_zone/"

  name    = "citl.club"
  comment = "CITL public zone"
  tags    = local.tags
}

resource "aws_route53_record" "citl_club" {
  zone_id = module.route53_zone_citl_club.zone_id
  name    = "citl.club"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.citl_s3_distribution.domain_name
    zone_id                = aws_cloudfront_distribution.citl_s3_distribution.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "www_citl_club" {
  zone_id = module.route53_zone_citl_club.zone_id
  name    = "www.citl.club"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.citl_s3_distribution.domain_name
    zone_id                = aws_cloudfront_distribution.citl_s3_distribution.hosted_zone_id
    evaluate_target_health = false
  }
}

# ------------------------------------------------------------------------------
# ACM
# ------------------------------------------------------------------------------

# citl.club certificate
module "acm_cert_citl_club" {
  source = "git::https://github.com/tdeknecht/aws-terraform//modules/network/acm_certificate/"

  ou                        = local.ou
  certificate_domain_name   = "citl.club"
  validation_domain_name    = "citl.club"
  validation_method         = "DNS"
  subject_alternative_names = ["www.citl.club"]
  tags                      = local.tags
}
output "certificate_arn_citl_club" { value = module.acm_cert_citl_club.certificate_arn }

# ------------------------------------------------------------------------------
# CloudFront
# ------------------------------------------------------------------------------

resource "aws_cloudfront_distribution" "citl_s3_distribution" {
  aliases             = ["www.citl.club", "citl.club"]
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "CITL distribution"
  default_root_object = "index.html"
  price_class         = "PriceClass_100"
  tags                = local.tags

  origin {
    domain_name = module.s3_bucket_citl_club.bucket_domain_name
    origin_id   = local.s3_origin_id
  }

  viewer_certificate {
    acm_certificate_arn      = module.acm_cert_citl_club.certificate_arn
    minimum_protocol_version = "TLSv1.2_2018"
    ssl_support_method       = "sni-only"
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = local.s3_origin_id
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
}

# ------------------------------------------------------------------------------
# S3: Buckets
# ------------------------------------------------------------------------------

# citl.club (website host)
module "s3_bucket_citl_club" {
  source = "git::https://github.com/tdeknecht/aws-terraform//modules/storage/s3_bucket/"

  ou                  = local.ou
  use_case            = local.use_case
  bucket              = "citl.club"
  versioning          = true
  base_lifecycle_rule = true
  policy              = data.aws_iam_policy_document.s3_bucket_policy_citl_club.json
  tags                = local.tags

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
output "s3_citl_club_bucket_domain_name" { value = module.s3_bucket_citl_club.bucket_domain_name }

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
  source = "git::https://github.com/tdeknecht/aws-terraform//modules/storage/s3_bucket/"

  ou                  = local.ou
  use_case            = local.use_case
  bucket              = "www.citl.club"
  versioning          = false
  base_lifecycle_rule = false
  tags                = local.tags

  # website config
  redirect_all_requests_to = "https://citl.club"
}

# citl (data)
module "s3_bucket_citl" {
  source = "git::https://github.com/tdeknecht/aws-terraform//modules/storage/s3_bucket/"

  ou                  = local.ou
  use_case            = local.use_case
  bucket              = "citl"
  versioning          = false
  base_lifecycle_rule = true
  policy              = data.aws_iam_policy_document.s3_bucket_policy_citl.json
  tags                = local.tags
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
