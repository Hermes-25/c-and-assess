type RateEntry={count:number;resetAt:number};

const buckets=new Map<string,RateEntry>();
const MAX_BUCKETS=20_000;

function clientKey(request:Request){
  return request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
}

function prune(now:number){
  if(buckets.size<MAX_BUCKETS)return;
  for(const [key,value] of buckets){if(value.resetAt<=now)buckets.delete(key);}
  if(buckets.size>=MAX_BUCKETS){const oldest=buckets.keys().next().value as string|undefined;if(oldest)buckets.delete(oldest);}
}

export function protectMutation(request:Request,{scope,limit=60,windowMs=60_000}:{scope:string;limit?:number;windowMs?:number}){
  const url=new URL(request.url),origin=request.headers.get('origin'),fetchSite=request.headers.get('sec-fetch-site');
  if(origin!==url.origin||(fetchSite!==null&&!['same-origin','none'].includes(fetchSite)))return Response.json({error:'Same-origin request required.'},{status:403});
  const now=Date.now();prune(now);const key=`${scope}:${clientKey(request)}`;const current=buckets.get(key);
  if(!current||current.resetAt<=now){buckets.set(key,{count:1,resetAt:now+windowMs});return null;}
  current.count+=1;
  if(current.count>limit)return Response.json({error:'Too many requests. Wait briefly and try again.'},{status:429,headers:{'retry-after':String(Math.max(1,Math.ceil((current.resetAt-now)/1000)))}});
  return null;
}
