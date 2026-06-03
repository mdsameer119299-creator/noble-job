const ICONS:Record<string,string>={general:'💬',support:'🛠️',employer:'🏢',candidate:'👤',partnership:'🤝',feedback:'⭐'}
interface InquiryIconProps{type:string;size?:number}
export function InquiryIcon({type,size=24}:InquiryIconProps){
  return <span style={{fontSize:size}}>{ICONS[type]||'📩'}</span>
}
