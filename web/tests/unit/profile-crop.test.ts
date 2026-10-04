import {expect, it} from 'vitest';
import {cropGeometry, initialCrop} from '../../features/profile/crop';
it('covers the crop square and bounds panning for landscape and portrait rotation', () => {
  expect(cropGeometry(400,200,initialCrop)).toEqual({scale:1,panX:100,panY:0,offsetX:0,offsetY:0});
  expect(cropGeometry(400,200,{...initialCrop,rotation:90,x:100,y:-100})).toEqual({scale:1,panX:0,panY:100,offsetX:0,offsetY:-100});
  expect(cropGeometry(200,400,{zoom:2,rotation:-90,x:50,y:-50})).toEqual({scale:2,panX:300,panY:100,offsetX:150,offsetY:-50});
});
