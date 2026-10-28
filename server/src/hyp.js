// perf3: shared by the server's hot paths (fog.js sight tests, path.js A*, bots.js routes).
// Math.hypot of 2 / 3 terms as V8's builtin computes it (max scaling, Kahan sum: bit-identical, test-bvh-fast.js checks), without
// the builtin's per-call argument array (~70 B); all-zero inputs answer +0 as the builtin does, non-finite ones take the builtin (the unary + keeps the result an untagged double)
export function hyp2(x,z){const a=Math.abs(x),b=Math.abs(z),m=a>b?a:b;if(m>0&&m<Infinity&&b===b){const qa=a/m,qb=b/m;return Math.sqrt(qa*qa+qb*qb)*m;}if(m===0&&a===a)return 0;/* hypot(±0, ±0) = +0 (a node at the goal: the A* heuristic) */return +Math.hypot(x,z);}
export function hyp3(x,y,z){const a=Math.abs(x),b=Math.abs(y),c=Math.abs(z);let m=a>b?a:b;if(c>m)m=c;if(m>0&&m<Infinity&&a===a&&b===b&&c===c){let q=a/m,u=q*q,s=u,k=0;q=b/m;u=q*q-k;let p=s+u;k=(p-s)-u;s=p;q=c/m;u=q*q-k;p=s+u;s=p;return Math.sqrt(s)*m;}if(m===0&&a===a&&b===b&&c===c)return 0;return +Math.hypot(x,y,z);}
