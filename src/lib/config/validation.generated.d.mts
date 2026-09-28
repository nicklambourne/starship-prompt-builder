interface SchemaError {
  instancePath: string;
  keyword: string;
  message?: string;
  params: { additionalProperty?: string };
}
declare const validate: {
  (value: unknown): boolean;
  errors: SchemaError[] | null;
};
export default validate;
