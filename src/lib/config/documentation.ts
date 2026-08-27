/** A link preserved from Starship's option and variable documentation. */
export interface DocumentationLink {
  label: string;
  url: string;
}

/** The prose shown in the builder, plus any references that prose contains. */
export interface Documentation {
  description: string;
  links?: DocumentationLink[];
}
