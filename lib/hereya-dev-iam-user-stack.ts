import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

/**
 * DevDeploy package that creates an IAM user for local development.
 *
 * Collects all IAM policy env vars (iamPolicy* / IAM_POLICY_*) from the
 * project environment and attaches them to a single IAM user. The user's
 * access key credentials are stored in SSM Parameter Store and exported
 * as outputs (devAwsAccessKeyId, devAwsSecretAccessKey, devAwsRegion).
 * Users can map these to AWS_ACCESS_KEY_ID etc. via hereyastaticenv.
 *
 * This allows developers to run their app locally with the exact same
 * permissions that the deployed version would have, without needing
 * admin-level AWS credentials.
 */
export class HereyaDevIamUserStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Read all env vars — devDeploy packages receive projectEnv merged into env
    const env = process.env;

    // Collect IAM policy env vars (same pattern as aws-ecs-deploy)
    const policyEntries = Object.entries(env).filter(
      ([key]) => key.startsWith('IAM_POLICY_') || key.startsWith('iamPolicy')
    );

    // Create IAM user
    const userName = `${this.stackName}-dev-user`;
    const user = new iam.User(this, 'DevUser', {
      userName,
    });

    // Attach all collected IAM policies to the user
    for (const [, value] of policyEntries) {
      if (!value) continue;
      try {
        const policy = JSON.parse(value);
        if (policy.Statement && Array.isArray(policy.Statement)) {
          for (const statement of policy.Statement) {
            user.addToPolicy(iam.PolicyStatement.fromJson(statement));
          }
        }
      } catch {
        // Skip malformed policy JSON
      }
    }

    // Create access key for the user
    const accessKey = new iam.AccessKey(this, 'DevUserAccessKey', {
      user,
    });

    // Store the secret access key in SSM Parameter Store (SecureString)
    const secretKeyParam = new ssm.StringParameter(this, 'DevUserSecretKeyParam', {
      parameterName: `/hereya/dev-iam-user/${this.stackName}/secret-access-key`,
      stringValue: accessKey.secretAccessKey.unsafeUnwrap(),
      description: `Secret access key for dev IAM user ${userName}`,
      tier: ssm.ParameterTier.STANDARD,
    });

    // Store the access key ID in SSM Parameter Store
    const accessKeyIdParam = new ssm.StringParameter(this, 'DevUserAccessKeyIdParam', {
      parameterName: `/hereya/dev-iam-user/${this.stackName}/access-key-id`,
      stringValue: accessKey.accessKeyId,
      description: `Access key ID for dev IAM user ${userName}`,
      tier: ssm.ParameterTier.STANDARD,
    });

    // Outputs — these become env vars in the workspace.
    // CloudFormation output keys must be alphanumeric (no underscores).
    // Use camelCase keys; users can map to AWS_* env vars via hereyastaticenv.
    new cdk.CfnOutput(this, 'devAwsAccessKeyId', {
      value: accessKeyIdParam.parameterArn,
      description: 'SSM parameter ARN for the dev IAM user access key ID',
    });

    new cdk.CfnOutput(this, 'devAwsSecretAccessKey', {
      value: secretKeyParam.parameterArn,
      description: 'SSM parameter ARN for the dev IAM user secret access key',
    });

    new cdk.CfnOutput(this, 'devAwsRegion', {
      value: this.region,
      description: 'AWS region for the dev IAM user',
    });

    new cdk.CfnOutput(this, 'devIamUserName', {
      value: user.userName,
      description: 'Name of the dev IAM user',
    });

    new cdk.CfnOutput(this, 'devIamUserArn', {
      value: user.userArn,
      description: 'ARN of the dev IAM user',
    });
  }
}
