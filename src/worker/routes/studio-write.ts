import { Hono } from "hono";
import { mutationSchema } from "@/shared/studio-mutations";
import type { WorkerBindings } from "../env";
export interface StudioWriterNamespace {idFromName(name:string):unknown;get(id:unknown):{fetch(request:Request):Promise<Response>}}
type Env=WorkerBindings&{STUDIO_WRITER?:StudioWriterNamespace};
/** Mounted after session verification; clients cannot choose sheet credentials. */
export function studioWriteRoutes(){
  return new Hono<{Bindings:WorkerBindings}>()
    .use("*",async(c,next)=>{c.header("Cache-Control","no-store");await next();})
    .post("/mutations",async c=>{
      if((c.req.header("Origin")&&c.req.header("Origin")!==new URL(c.req.url).origin)||c.req.header("Sec-Fetch-Site")==="cross-site")return c.json({error:{code:"FORBIDDEN",message:"Cross-origin writes are not allowed."}},403);
      if(!c.req.header("Content-Type")?.toLowerCase().startsWith("application/json"))return c.json({error:{message:"Expected application/json."}},415);
      const raw=await c.req.text();if(raw.length>5_000_000)return c.json({error:{message:"Operation is too large."}},413);
      let value:unknown;try{value=JSON.parse(raw);}catch{return c.json({error:{message:"Invalid operation."}},400);}
      const parsed=mutationSchema.safeParse(value);if(!parsed.success)return c.json({error:{message:"Invalid operation."}},400);
      const env=c.env as Env;if(!env.STUDIO_WRITER||!env.GOOGLE_SHEET_ID||!env.GOOGLE_CREDENTIALS_JSON)return c.json({error:{code:"STUDIO_WRITE_UNAVAILABLE",message:"Sheet writer is not configured. Nothing was written."}},503);
      try{return await env.STUDIO_WRITER.get(env.STUDIO_WRITER.idFromName("studio-v1:"+env.GOOGLE_SHEET_ID)).fetch(new Request("https://studio.internal/mutate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sheetId:env.GOOGLE_SHEET_ID,credentials:env.GOOGLE_CREDENTIALS_JSON,operation:parsed.data})}));}
      catch{return c.json({error:{code:"SAVE_UNCERTAIN",message:"Save not confirmed. Retry safely checks the same operation receipt."}},503);}
    })
    .get("/mutations/:id",async c=>{
      const id=c.req.param("id");if(!/^[A-Za-z0-9_-]{12,100}$/.test(id))return c.json({error:{message:"Invalid operation ID."}},400);
      const env=c.env as Env;if(!env.STUDIO_WRITER)return c.json({error:{message:"Writer unavailable."}},503);
      try{return await env.STUDIO_WRITER.get(env.STUDIO_WRITER.idFromName("studio-v1:"+env.GOOGLE_SHEET_ID)).fetch(new Request("https://studio.internal/status",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sheetId:env.GOOGLE_SHEET_ID,credentials:env.GOOGLE_CREDENTIALS_JSON,statusId:id})}));}
      catch{return c.json({error:{message:"Unable to reconcile the save yet."}},503);}
    });
}
