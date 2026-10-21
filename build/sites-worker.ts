import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import { raiseOperationalAlert } from "../lib/operations";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";
export {BrowserSession} from "../lib/browser-session-do";

const scheduledTasks = [
  { name: "billing", path: "/api/internal/billing-tick" },
  { name: "missions", path: "/api/internal/mission-tick" },
  { name: "operations", path: "/api/internal/operations-tick" },
] as const;

async function runScheduledTasks(
  scheduledTime: number,
  env: Cloudflare.Env,
  ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>,
) {
  const secret = env.SCHEDULER_SECRET;
  if (!secret || secret.length < 32) {
    console.error("Aïra scheduled tasks are not configured.");
    return;
  }
  const slot = Math.floor(scheduledTime / 300_000);
  for (const task of scheduledTasks) {
    try {
      const request = new Request(`https://aira.internal${task.path}`, {
        method: "POST",
        headers: { authorization: `Bearer ${secret}` },
      });
      const response = await runWithConnectorBinding(undefined, () =>
        handler.fetch(request, env, ctx),
      );
      if (response.ok) continue;
      await raiseOperationalAlert(
        `cron:${slot}:${task.name}`,
        "scheduled_task_failed",
        task.name,
      );
      console.error("Aïra scheduled task returned an error.", task.name, response.status);
    } catch {
      try {
        await raiseOperationalAlert(
          `cron:${slot}:${task.name}`,
          "scheduled_task_failed",
          task.name,
        );
      } catch {
        // If storage itself is unavailable, keep only a sanitized platform log.
      }
      console.error("Aïra scheduled task failed.", task.name);
    }
  }
}

export default {
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    return runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
  },
  scheduled(
    controller: ScheduledController,
    env: Cloudflare.Env,
    ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>,
  ) {
    ctx.waitUntil(runScheduledTasks(controller.scheduledTime, env, ctx));
  },
};
