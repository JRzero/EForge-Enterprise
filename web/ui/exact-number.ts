export type ExactNumberRules={min?:string;max?:string;scale?:number;integer?:boolean};
type Decimal={negative:boolean;digits:string;exponent:bigint};

function decimal(value:string):Decimal|null{
  const match=/^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/.exec(value);
  if(!match)return null;
  const fraction=match[3]??match[4]??'',power=BigInt(match[5]??'0');
  // Java BigDecimal's scale is a signed 32-bit integer, including exponent notation.
  let exponent=power-BigInt(fraction.length);
  if(exponent < -2147483647n || exponent > 2147483648n)return null;
  let digits=((match[2]??'')+fraction).replace(/^0+/,'');
  if(!digits)return {negative:false,digits:'0',exponent:0n};
  const trailing=/0+$/.exec(digits)?.[0].length??0;
  if(trailing){digits=digits.slice(0,-trailing);exponent+=BigInt(trailing);}
  return {negative:match[1]==='-',digits,exponent};
}
function compare(a:Decimal,b:Decimal){
  if(a.digits==='0'&&b.digits==='0')return 0;
  if(a.negative!==b.negative)return a.negative?-1:1;
  const direction=a.negative?-1:1;
  if(a.digits==='0')return -direction;if(b.digits==='0')return direction;
  const sizeA=BigInt(a.digits.length)+a.exponent,sizeB=BigInt(b.digits.length)+b.exponent;
  if(sizeA!==sizeB)return (sizeA<sizeB?-1:1)*direction;
  const width=Math.max(a.digits.length,b.digits.length),left=a.digits.padEnd(width,'0'),right=b.digits.padEnd(width,'0');
  return (left===right?0:left<right?-1:1)*direction;
}
/** Empty is separate from zero; required remains the form's responsibility. Never rounds. */
export function exactNumberIssue(value:string,rules:ExactNumberRules={}):string{
  if(value==='')return '';
  const parsed=decimal(value);if(!parsed)return '请输入有效的精确数值。';
  if(rules.integer&& !/^[+-]?\d+$/.test(value))return '请输入整数。';
  if(rules.scale!==undefined){
    if(!Number.isSafeInteger(rules.scale)||rules.scale<0)throw Error('Invalid decimal scale');
    if(parsed.exponent < -BigInt(rules.scale))return `最多保留${rules.scale}位小数，请自行调整，不会自动舍入。`;
  }
  for(const [bound,label] of [[rules.min,'最小'],[rules.max,'最大']] as const){
    if(bound===undefined)continue;const limit=decimal(bound);if(!limit)throw Error('Invalid decimal bound');
    const result=compare(parsed,limit);if(label==='最小'?result<0:result>0)return `数值不能${label==='最小'?'小于':'大于'}${bound}。`;
  }
  return '';
}
/** Only unambiguous comma groups are normalized. Invalid separators remain visible for correction. */
export function normalizeNumberPaste(value:string):string{
  const trimmed=value.trim();return /^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(trimmed)?trimmed.replaceAll(',',''):trimmed;
}
