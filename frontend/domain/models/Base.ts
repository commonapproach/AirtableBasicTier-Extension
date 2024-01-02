export class Base {
  protected _fields;
  public getFieldByName(name: string): any {
    return this._fields.find((field) => field.name === name);
  }

  public getFields(): any {
    return this._fields;
  }
}
