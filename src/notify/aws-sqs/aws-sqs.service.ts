import { Injectable } from '@nestjs/common';
import { MessageAttributeValue, SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { createMessage, etag, hmac, Notify, Process } from '@letsflow/core/process';
import { NotifyProvider } from '../notify-provider.interface';
import { ConfigService } from '@/common/config/config.service';
import { clean } from '@/common/utils/clean';

export interface AwsSqsOptions {
  queueUrl: string;
  messageAttributes?: Record<string, string>;
  replySecret?: string;
}

@Injectable()
export class AwsSqsService implements NotifyProvider {
  constructor(
    private client: SQSClient,
    private readonly config: ConfigService,
  ) {}

  async notify(process: Process, args: Notify): Promise<void> {
    const settings = this.config.get('services')[args.service] as AwsSqsOptions | undefined;
    if (!settings) {
      throw new Error(`Service '${args.service}' not configured for SQS`);
    }

    const { queueUrl, messageAttributes, replySecret } = settings;

    const message = args.message ?? createMessage(process, args.service);
    const replyToken = replySecret
      ? hmac({ process: process.id, etag: etag(process), service: args.service }, replySecret)
      : undefined;

    await this.client.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: typeof message === 'string' ? message : JSON.stringify(message),
        MessageAttributes: clean({
          ...this.convertAttributes(messageAttributes ?? {}),
          ProcessId: { DataType: 'string', StringValue: process.id },
          Service: { DataType: 'string', StringValue: args.service },
          Etag: { DataType: 'string', StringValue: etag(process) },
          ReplyToken: replyToken ? { DataType: 'string', StringValue: replyToken } : undefined,
        }),
      }),
    );
  }

  private convertAttributes(attributes: Record<string, string | number>): Record<string, MessageAttributeValue> {
    return Object.entries(attributes).reduce(
      (acc, [key, value]) => {
        acc[key] = { DataType: typeof value === 'number' ? 'number' : 'string', StringValue: value.toString() };
        return acc;
      },
      {} as Record<string, MessageAttributeValue>,
    );
  }
}
