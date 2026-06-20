# Deploying the TMB availability checker to AWS

This guide deploys the Tour du Mont Blanc refuge availability checker as a
scheduled AWS Lambda job. The job checks every row in `tmb/checks.json`, sends an
email summary every time it runs, and records per-check state in DynamoDB.

## What AWS resources are created

The SAM template in `template.yaml` creates:

- Lambda function: runs `tmb/lambda.handler`
- EventBridge schedule: invokes the Lambda on a configurable interval
- DynamoDB table: stores per-check availability and notification state
- IAM permissions: DynamoDB read/write and SES send permissions

## Prerequisites

Install and configure these on the machine that will deploy the stack:

```bash
aws --version
sam --version
aws configure
```

Confirm the AWS identity before deploying:

```bash
aws sts get-caller-identity
```

## SES email setup

The stack uses Amazon SES to send availability emails.

1. Open Amazon SES in the AWS region where you will deploy.
2. Verify the sender email address. By default this is
   `mnarahari@gmail.com`, controlled by the `NotificationFromEmail` parameter.
3. If the AWS account is still in the SES sandbox, also verify the recipient
   email addresses, `mnarahari@gmail.com` and `anu.narahari@gmail.com`, or
   request SES production access.

You can verify an email address from the CLI:

```bash
aws ses verify-email-identity --email-address mnarahari@gmail.com
aws ses verify-email-identity --email-address anu.narahari@gmail.com
```

After running that command, open the verification email and click the AWS link.

## Configure hotel/date checks

The current checks are in `tmb/checks.json`:

- Edelweiss, La Fouly, 2026-08-07
- Les Chambres du Soleil, Les Chapieux / Les Mottets, 2026-08-03
- Auberge-Refuge de la Nova, Les Chapieux / Les Mottets, 2026-08-03

Add more entries to the `checks` array using this shape:

```json
{
  "id": "unique-hotel-location-date-id",
  "date": "2026-08-07",
  "location": "La Fouly",
  "hotelName": "Auberge Maya-Joie",
  "refugeSlug": "maya-joie"
}
```

`refugeSlug` is optional but recommended. It lets the checker fall back to the
direct refuge calendar page if the search-results card cannot be matched.

## Local pre-deploy check

Run the configured checks locally:

```bash
npm install
npm test
npm run tmb:check
```

This does not send email.

## Deploy with AWS SAM

From the repo root:

```bash
sam build
sam deploy --guided \
  --stack-name tmb-availability-checker \
  --capabilities CAPABILITY_IAM
```

Suggested guided values:

- Stack Name: `tmb-availability-checker`
- AWS Region: your SES-configured region, for example `us-east-1`
- Parameter `NotificationEmail`: `mnarahari@gmail.com`
- To send to both configured recipients, use
  `mnarahari@gmail.com,anu.narahari@gmail.com`
- Parameter `NotificationFromEmail`: `mnarahari@gmail.com`
- Parameter `ScheduleExpression`: `rate(1 hour)`
- Parameter `RenotifyAfterHours`: `24`
- Confirm changes before deploy: `Y`
- Allow SAM CLI IAM role creation: `Y`
- Save arguments to configuration file: `Y`

For later deploys after `samconfig.toml` is saved:

```bash
sam build
sam deploy
```

## Run the Lambda once after deployment

Get the function name:

```bash
aws cloudformation describe-stacks \
  --stack-name tmb-availability-checker \
  --query "Stacks[0].Outputs[?OutputKey=='TmbAvailabilityCheckerFunctionName'].OutputValue" \
  --output text
```

Invoke it once:

```bash
FUNCTION_NAME=$(aws cloudformation describe-stacks \
  --stack-name tmb-availability-checker \
  --query "Stacks[0].Outputs[?OutputKey=='TmbAvailabilityCheckerFunctionName'].OutputValue" \
  --output text)

aws lambda invoke \
  --function-name "$FUNCTION_NAME" \
  --payload '{}' \
  response.json

cat response.json
```

The response JSON includes:

- `checked`: number of configured checks run
- `available`: number currently available
- `notificationsSent`: number of emails sent
- `results`: per-check details and booking URLs when available

The email subject is `No availability` when no configured checks are bookable.
It is `Availability found - act on it ASAP` when at least one check is bookable.

## Check logs

```bash
sam logs \
  --stack-name tmb-availability-checker \
  --name TmbAvailabilityCheckerFunction \
  --tail
```

Or use AWS CLI:

```bash
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/tmb-availability-checker
```

## Updating checks after deployment

1. Edit `tmb/checks.json`.
2. Run:

   ```bash
   npm test
   npm run tmb:check
   sam build
   sam deploy
   ```

The DynamoDB state is keyed by each check's `id`. If you change an existing
check's `id`, AWS will treat it as a new check for notification deduplication.

## Troubleshooting

### No email arrives

- Confirm SES sender verification.
- If in SES sandbox, confirm recipient verification.
- Check Lambda logs for `ses:SendEmail` errors.
- Confirm `notificationsSent` is greater than `0` in the Lambda response.
- The current job sends one summary email on every run so you know the schedule
  is still active.

### Lambda reports unavailable when the site looks available

- Run `npm run tmb:check` locally to compare.
- Confirm the configured `location`, `hotelName`, and `date` match the site.
- Add or correct `refugeSlug` for that hotel.
- The primary signal is a `Book` link/button on the matching search-result card.

### Schedule is not running

Check the EventBridge rule:

```bash
aws events list-rules --name-prefix tmb-availability-checker
```

Check recent Lambda invocations:

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value="$FUNCTION_NAME" \
  --start-time "$(date -u -d '3 hours ago' +%Y-%m-%dT%H:%M:%SZ)" \
  --end-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --period 3600 \
  --statistics Sum
```

