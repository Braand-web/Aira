# Public pages origin

The public pages host uses the exact verified application build and `lib/public-pages-gateway.mjs`. Copy the gateway into the build's `dist/server/` directory, then generate an entry beside `index.js`:

```js
import application from './index.js';
import {publicPagesGateway} from './public-pages-gateway.mjs';
export default publicPagesGateway(application);
```

Deploy that entry with `no_bundle`, `find_additional_modules`, the existing module rules, a D1 binding and `PAGES_ORIGIN` set to this host's exact HTTPS origin. No assets, application keys, authentication secrets, browser, queues or crons belong to this deployment. Publication visibility, subscription entitlement, form consent and request rate limits are checked by the existing publication handler. A form-enabled host additionally needs its own private `PAGE_FORM_SECRET` for the existing IP hashing; it does not grant approval to publish.

Set the main application's `PAGES_ORIGIN` to the same origin only after verifying that private routes and the application root return 404. Do not reuse the application's authenticated origin. Deploying the host does not publish any draft, grant an entitlement or approve any publication.
