export class Base {
  protected _fields: FieldType[];
  public getFieldByName(name: string): FieldType {
    return this._fields.find((field) => field.name === name);
  }

  public getFields(): FieldType[] {
    return this._fields;
  }
}

export type FieldType = {
  name: string;
  type: string;
  defaultValue?: any;
  representedType: string;
  primary?: boolean;
  unique?: boolean;
  notNull?: boolean;
  link?: any;
  required: boolean;
  semiRequired: boolean;
};
