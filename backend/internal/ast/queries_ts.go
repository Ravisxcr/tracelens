package ast

// TSQueries defines Tree-sitter queries for TypeScript and JavaScript source code.
const (
	TSFunctionsQuery = `
[
  (function_declaration
    name: (identifier) @name
    parameters: (formal_parameters) @params
    return_type: (type_annotation)? @result
    body: (statement_block)? @body) @def

  (variable_declarator
    name: (identifier) @name
    value: [
      (arrow_function)
      (function_expression)
    ] @body) @def
]
`

	TSClassesQuery = `
[
  (class_declaration
    name: (type_identifier) @name
    body: (class_body) @body) @def

  (interface_declaration
    name: (type_identifier) @name
    body: (interface_body) @body) @def

  (type_alias_declaration
    name: (type_identifier) @name
    value: (_) @type) @def
]
`

	TSMethodsQuery = `
(method_definition
  name: [
    (property_identifier)
    (private_property_identifier)
  ] @name
  parameters: (formal_parameters) @params
  return_type: (type_annotation)? @result
  body: (statement_block)? @body) @def
`

	TSCallsQuery = `
(call_expression
  function: [
    (identifier) @call.direct
    (member_expression
      object: (_) @call.receiver
      property: [
        (property_identifier)
        (private_property_identifier)
      ] @call.field)
  ]
  arguments: (arguments) @call.args) @call.expr
`

	TSImportsQuery = `
(import_statement
  source: (string) @path) @def
`
)

