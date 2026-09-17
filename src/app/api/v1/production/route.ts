import { handler, json } from "@/lib/api";
import { productionSnapshot } from "@/lib/integrations/snapshot";

export const GET = handler("read", async () => json(await productionSnapshot()));
