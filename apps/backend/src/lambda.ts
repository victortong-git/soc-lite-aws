import serverless from 'serverless-http';
import app from './app';

// Export the Lambda handler
export const handler = serverless(app, {
  request(request: any, event: any, context: any) {
    // Attach AWS context to request for debugging
    request.context = context;
    request.event = event;
  }
});
