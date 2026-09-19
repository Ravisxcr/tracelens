package ast

// CQueries defines Tree-sitter queries for C and C++ source code.
const (
	CFunctionsQuery = `
(function_definition
  type: (_)? @func.return
  declarator: [
    (function_declarator
      declarator: [
        (identifier) @func.name
        (field_identifier) @func.name
        (qualified_identifier) @func.name
      ]
      parameters: (parameter_list) @func.params)
  ]
  body: (compound_statement)? @func.body) @func.def
`

	CStructsQuery = `
[
  (struct_specifier
    name: (type_identifier)? @struct.name
    body: (field_declaration_list)? @struct.body) @struct.def

  (class_specifier
    name: (type_identifier)? @class.name
    body: (field_declaration_list)? @class.body) @class.def

  (union_specifier
    name: (type_identifier)? @union.name
    body: (field_declaration_list)? @union.body) @union.def

  (enum_specifier
    name: (type_identifier)? @enum.name
    body: (enumerator_list)? @enum.body) @enum.def
]
`

	CTypedefQuery = `
(type_definition
  type: (_) @typedef.type
  declarator: (type_identifier) @typedef.name) @typedef.def
`

	CMacrosQuery = `
[
  (preproc_def
    name: (identifier) @macro.name
    value: (_)? @macro.value) @macro.def

  (preproc_function_def
    name: (identifier) @macro.name
    parameters: (preproc_params) @macro.params
    value: (_)? @macro.value) @macro.def
]
`

	CCallsQuery = `
(call_expression
  function: [
    (identifier) @call.name
    (field_expression
      argument: (_) @call.receiver
      field: (field_identifier) @call.field)
  ]
  arguments: (argument_list) @call.args) @call.expr
`
)

