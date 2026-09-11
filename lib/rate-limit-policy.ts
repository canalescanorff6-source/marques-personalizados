export type DistributedRateBucket={scope:string;limit:number;subject:'client'|'global'};

export function strictDistributedRateScope(scope:string){
  return scope.startsWith('admin-');
}

export function adminGlobalRateLimit(limit:number){
  const normalized=Math.max(1,Math.floor(limit));
  return Math.max(12,Math.min(600,normalized*4));
}

export function distributedRateBuckets(scope:string,limit:number,strict:boolean):DistributedRateBucket[]{
  const normalized=Math.max(1,Math.floor(limit));
  const buckets:DistributedRateBucket[]=[{scope,limit:normalized,subject:'client'}];
  if(strict)buckets.push({scope:`${scope}:global`,limit:adminGlobalRateLimit(normalized),subject:'global'});
  return buckets;
}
