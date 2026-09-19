package ast

// GoQueries defines Tree-sitter queries for Go source code.
const (
	GoFunctionsQuery = `
(function_declaration
  name: (identifier) @name
  parameters: (parameter_list) @params
  result: (_)? @result
  body: (block)? @body) @def
`

	GoMethodsQuery = `
(method_declaration
  receiver: (parameter_list) @receiver
  name: (field_identifier) @name
  parameters: (parameter_list) @params
  result: (_)? @result
  body: (block)? @body) @def
`

	GoTypesQuery = `
(type_declaration
  (type_spec
    name: (type_identifier) @name
    type: [
      (struct_type) @struct
      (interface_type) @interface
      (_) @alias
    ])) @def
`

	GoCallsQuery = `
(call_expression
  function: [
    (identifier) @call.direct
    (selector_expression
      operand: (_) @call.receiver
      field: (field_identifier) @call.field)
  ]
  arguments: (argument_list) @call.args) @call.expr
`

	GoImportsQuery = `
(import_spec
  name: (package_identifier)? @alias
  path: (interpreted_string_literal) @path) @def
`
)

