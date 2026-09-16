import { lazy, Suspense, useCallback, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { ApiError, weddingApi } from "@/client/api/client";
import { useLanguage } from "@/client/app/LanguageProvider";
import { useApiResource } from "@/client/app/useApiResource";
import { ErrorRoute, LoadingRoute } from "./RouteState";
const GlassHouseStudio=lazy(()=>import("@/client/studio/GlassHouseStudio"));
function StudioLogin({onLogin}:{onLogin:()=>void}){
  const [pending,setPending]=useState(false),[error,setError]=useState("");
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const form=event.currentTarget,passphrase=String(new FormData(form).get("passphrase")??"");setPending(true);setError("");
    try{await weddingApi.adminLogin(passphrase);form.reset();onLogin();}
    catch(cause){setError(cause instanceof ApiError&&cause.status===401?"Incorrect passphrase.":"Sign-in failed. Check your connection and try again.");}
    finally{setPending(false);}
  }
  return <main className="mx-auto max-w-sm px-6 py-16"><Link to="/admin" className="text-sm text-gold underline">← Admin dashboard</Link><h1 className="mt-6 font-display text-3xl text-ink">Glass House Studio</h1><p className="mt-3 text-sm text-muted">Use your existing administrator passphrase. Guest information is not bundled with the public application.</p><form onSubmit={submit} className="mt-6"><label htmlFor="studio-passphrase" className="text-xs text-muted">Administrator passphrase</label><input id="studio-passphrase" name="passphrase" type="password" autoComplete="current-password" required maxLength={500} className="mt-2 w-full rounded-lg border border-line bg-paper px-4 py-3"/>{error&&<p role="alert" className="mt-3 text-sm text-blush-deep">{error}</p>}<button type="submit" disabled={pending} className="mt-5 w-full rounded-full bg-ink px-6 py-3 text-cream disabled:opacity-60">{pending?"Signing in…":"Open studio"}</button></form></main>;
}
export default function AdminStudioRoute(){
  const {lang}=useLanguage(),[revision,setRevision]=useState(0);
  const refresh=useCallback(()=>setRevision(value=>value+1),[]);
  const access=useApiResource(`native-studio-access:${lang}:${revision}`,()=>weddingApi.adminSummary(lang));
  if(access.state==="loading")return <LoadingRoute lang={lang}/>;
  if(access.state==="unauthorized")return <StudioLogin onLogin={refresh}/>;
  if(access.state!=="ready")return <ErrorRoute lang={lang}/>;
  return <Suspense fallback={<LoadingRoute lang={lang}/>}><GlassHouseStudio loadSiteGuests={weddingApi.adminStudioGuests} onUnauthorized={refresh}/></Suspense>;
}
