declare module "virtual:sites-connector-preview" {
  const binding: import("./connector-contract.mjs").ConnectorBinding;
  export default binding;
}

// Only the local preview uses an environment binding. A managed gateway can provide the
// request-scoped capability through ctx.props.CONNECTORS in worker.ts.
declare namespace Cloudflare {
  interface Env {
    CONNECTORS?: import("./connector-contract.mjs").ConnectorBinding;
  }
}
