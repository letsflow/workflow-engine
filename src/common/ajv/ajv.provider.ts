import Ajv from 'ajv/dist/2020';

export const ajvProvider = {
  provide: Ajv,
  useValue: new Ajv(),
};
