# Sample Python fixture simulating CPython high-level bindings

DEFAULT_FLAGS = 0

class IntObject:
    def __init__(self, value: int):
        self.value = value

    def to_string(self) -> str:
        return str(self.value)

def create_int(val: int) -> IntObject:
    obj = IntObject(val)
    return obj

def process_numbers():
    first = create_int(42)
    s = first.to_string()
    return s

