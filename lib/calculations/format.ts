export function currency(value:number){ return new Intl.NumberFormat("nb-NO",{style:"currency",currency:"NOK",maximumFractionDigits:2}).format(Number(value)||0); }
export function num(value:number,digits=2){ return new Intl.NumberFormat("nb-NO",{maximumFractionDigits:digits}).format(Number(value)||0); }
