package ast

// PyQueries defines Tree-sitter queries for Python source code.
const (
	PyFunctionsQuery = `
(function_definition
  name: (identifier) @func.name
  parameters: (parameters) @func.params
  return_type: (type)? @func.return
  body: (block) @func.body) @func.def
`

	PyClassesQuery = `
(class_definition
  name: (identifier) @class.name
  superclasses: (argument_list)? @class.bases
  body: (block) @class.body) @class.def
`

	PyCallsQuery = `
(call
  function: [
    (identifier) @call.name
    (attribute
      object: (_) @call.receiver
      attribute: (identifier) @call.field)
  ]
  arguments: (argument_list) @call.args) @call.expr
`

	PyImportsQuery = `
[
  (import_statement
    name: [
      (dotted_name) @import.name
      (aliased_import
        name: (dotted_name) @import.name
        alias: (identifier) @import.alias)
    ]) @import.def

  (import_from_statement
    module_name: (dotted_name) @import.from
    name: [
      (dotted_name) @import.name
      (aliased_import
        name: (dotted_name) @import.name
        alias: (identifier) @import.alias)
    ]) @import.def
]
`
)

