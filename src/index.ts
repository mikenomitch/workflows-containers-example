import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import { Container, getContainer } from "@cloudflare/containers";

type Params = {
    message?: string;
};

export class HelloWorldWorkflow extends WorkflowEntrypoint<Env, Params> {
    async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
        // Call container.fetch to POST to /hello endpoint
        const result = await step.do('call-hello-endpoint', async () => {
            const message = event.payload?.message || 'Hello from Cloudflare Workflows!';
            const container = getContainer(this.env.MY_CONTAINER, `workflow-${Date.now()}`);

            const response = await container.fetch('/hello', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message })
            });

            const responseData = await response.text();

            return {
                response: responseData,
                status: response.status,
                executedAt: new Date().toISOString()
            };
        });

        return {
            result,
            timestamp: Date.now(),
            status: 'completed',
            message: event.payload?.message || 'Hello from Cloudflare Workflows!'
        };
    }
}

export class MyContainer extends Container<Env> {
  defaultPort = 8080;
  sleepAfter = "1h";
  envVars = {
    MESSAGE: "default top level - can be overriden on specific instances",
  };

  override onStart() {
    console.log("Container was booted");
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Default response
    if (url.pathname === "/" && request.method === "GET") {
      return new Response(JSON.stringify({
        message: '🎉 CLOUDFLARE WORKFLOWS + CONTAINERS (step.container API)',
        description: 'Hello World container workflow demo using step.container',
        usage: {
          method: 'POST',
          path: '/run',
          body: '{ "message": "Your custom message" }'
        },
        note: 'This workflow runs a distroless container as a step'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }


    // Start a new workflow
		if (request.method === 'POST' && url.pathname === '/run') {
			const body = await request.json() as { message?: string };
			const workflowId = crypto.randomUUID();

			try {
				await env.HELLO_WORKFLOW.create({
					id: workflowId,
					params: { message: body.message }
				});

				return new Response(JSON.stringify({
					message: 'Hello World container workflow started with step.container API!',
					workflowId,
					status: 'running',
					api: 'step.container'
				}), {
					headers: { 'Content-Type': 'application/json' }
				});
			} catch (err) {
				return new Response(JSON.stringify({
					error: err instanceof Error ? err.message : JSON.stringify(err)
				}), {
					status: 500,
					headers: { 'Content-Type': 'application/json' }
				});
			}
		}


    return new Response("Not Found", { status: 404 });
  },
};
