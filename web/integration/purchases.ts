import {
  listPurchases,createPurchaseDraft,getPurchase,updatePurchaseDraft,listPurchaseApprovers,
  submitPurchase,decidePurchase,withdrawPurchase,listPurchaseAttachments,
  uploadPurchaseAttachment,downloadPurchaseAttachment,removePurchaseAttachment,
  type PurchaseCreateRequest,type PurchaseUpdateRequest,type PurchaseCommandRequest,type PurchaseDecisionRequest
} from '../generated/api';

/** Uses the application's authenticated transport; DTOs stay generated from OpenAPI. */
export function purchaseApi(transport:()=>typeof fetch){
  const options=(signal?:AbortSignal)=>({baseUrl:'',fetch:transport(),signal});
  return {
    async listPurchases(query:Parameters<typeof listPurchases>[0],signal?:AbortSignal){return (await listPurchases(query,options(signal))).data;},
    async getPurchase(id:string,signal?:AbortSignal){return (await getPurchase(id,options(signal))).data;},
    async createPurchaseDraft(body:PurchaseCreateRequest){return (await createPurchaseDraft(body,options())).data;},
    async updatePurchaseDraft(id:string,body:PurchaseUpdateRequest){return (await updatePurchaseDraft(id,body,options())).data;},
    async listPurchaseApprovers(query:Parameters<typeof listPurchaseApprovers>[0],signal?:AbortSignal){return (await listPurchaseApprovers(query,options(signal))).data;},
    async submitPurchase(id:string,body:PurchaseCommandRequest){return (await submitPurchase(id,body,options())).data;},
    async decidePurchase(id:string,body:PurchaseDecisionRequest){return (await decidePurchase(id,body,options())).data;},
    async withdrawPurchase(id:string,body:PurchaseCommandRequest){return (await withdrawPurchase(id,body,options())).data;},
    async listPurchaseAttachments(id:string,signal?:AbortSignal){return (await listPurchaseAttachments(id,options(signal))).data;},
    async uploadPurchaseAttachment(id:string,commandId:string,revision:string,file:File,signal?:AbortSignal){return (await uploadPurchaseAttachment(id,commandId,revision,{file},options(signal))).data;},
    async downloadPurchaseAttachment(id:string,attachmentId:string,signal?:AbortSignal){
      const data:unknown=(await downloadPurchaseAttachment(id,attachmentId,options(signal))).data;
      // The generated schema uses string/binary; fetchBlob returns a native Blob.
      if(!(data instanceof Blob))throw new Error('附件响应格式无效。');
      return data;
    },
    async removePurchaseAttachment(id:string,attachmentId:string,body:PurchaseCommandRequest){return (await removePurchaseAttachment(id,attachmentId,body,options())).data;}
  };
}
