export class Base {
  protected _fields: FieldType[];
  public getFieldByName(name: string): any {
    return this._fields.find((field) => field.name === name);
  }

  public getFields(): any {
    return this._fields;
  }
}

export type FieldType = {
  name: string;
  type: string;
  primary?: boolean;
  unique?: boolean;
  notNull?: boolean;
  link?: any;
  required: boolean;
};
