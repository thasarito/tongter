import { mutationSchema } from "@/shared/studio-mutations";
import { parseServiceAccount } from "./env";
import { createGoogleOAuth } from "./google/oauth";
import { createStudioGateway } from "./services/studio-gateway";
import { StudioWriterEngine, type PendingWrite } from "./services/studio-writer";
interface Storage {get<T>(key:string):Promise<T|undefined>;put(key:string,value:unknown):Promise<void>;delete(key:string):Promise<boolean>}
/** Internal binding only; no public route. Credentials are never stored/logged. */
export class StudioSheetWriter {
  private queue:Promise<unknown>=Promise.resolve();
  constructor(private state:{storage:Storage}){}
  async fetch(request:Request):Promise<Response>{
    const run=async()=>{
      try{
        const body=await request.json() as {sheetId:string;credentials:string;operation?:unknown;statusId?:string};
        if(!body.sheetId||!body.credentials)return Response.json({error:{message:"Writer configuration unavailable."}},{status:503});
        const oauth=createGoogleOAuth({credentials:parseServiceAccount(body.credentials)});
        const engine=new StudioWriterEngine(createStudioGateway({spreadsheetId:body.sheetId,getAccessToken:oauth.getAccessToken}),{get:()=>this.state.storage.get<PendingWrite>("pending"),set:value=>this.state.storage.put("pending",value),clear:async()=>{await this.state.storage.delete("pending");}});
        if(body.statusId&&/^[A-Za-z0-9_-]{12,100}$/.test(body.statusId))return await engine.status(body.statusId);
        const parsed=mutationSchema.safeParse(body.operation);if(!parsed.success)return Response.json({error:{message:"Invalid studio operation."}},{status:400});
        return await engine.execute(parsed.data);
      }catch{return Response.json({error:{code:"STUDIO_WRITE_UNAVAILABLE",message:"Unable to verify or save the sheet. Your pending edit is retained; retry safely."}},{status:503,headers:{"Cache-Control":"no-store"}});}
    };
    const result=this.queue.then(run,run);this.queue=result.catch(()=>undefined);return result;
  }
}
export default {fetch:()=>new Response("Not found",{status:404})};
