// Sample C fixture simulating CPython object model

#define Py_INCREF(op) (((PyObject*)(op))->ob_refcnt++)

typedef struct _object {
    int ob_refcnt;
    void *ob_type;
} PyObject;

typedef struct _typeobject {
    const char *tp_name;
    int tp_basicsize;
} PyTypeObject;

PyTypeObject PyLong_Type = {
    "int",
    sizeof(PyObject)
};

static PyObject* _PyLong_New(long v) {
    PyObject *obj = 0;
    return obj;
}

PyObject* PyLong_FromLong(long v) {
    PyTypeObject *tp = &PyLong_Type;
    PyObject *result = _PyLong_New(v);
    Py_INCREF(result);
    return result;
}

