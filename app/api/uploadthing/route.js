import { createRouteHandler } from "uploadthing/next";
import { ourFileRouter } from "./core";

// Export GET and POST route handlers for Uploadthing
export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
});
