export default function Loading() {
 return <div className="customer-loader" role="status" aria-live="polite"><div className="card-loading-preview" aria-hidden="true"><span className="loyalty-mark"/><div>{Array.from({length:8},(_,i)=><i key={i}/>)}</div></div><span>იტვირთება…</span></div>;
}
