import re

def check_brace_balance(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    depth = 0
    in_string = False
    string_char = ''
    in_comment = False
    in_multiline_comment = False
    
    for i in range(len(content)):
        char = content[i]
        prev_char = content[i-1] if i > 0 else ''
        next_char = content[i+1] if i < len(content)-1 else ''
        
        if not in_comment and not in_multiline_comment and not in_string:
            if char == '/' and next_char == '/':
                in_comment = True
            elif char == '/' and next_char == '*':
                in_multiline_comment = True
            elif char in ["'", '"', "`"]:
                in_string = True
                string_char = char
            elif char == '{':
                depth += 1
            elif char == '}':
                depth -= 1
        elif in_comment:
            if char == '\n':
                in_comment = False
        elif in_multiline_comment:
            if char == '/' and prev_char == '*':
                in_multiline_comment = False
        elif in_string:
            if char == string_char and prev_char != '\\':
                in_string = False
        
        if depth < 0:
            print(f"Negative depth at index {i}, near: {content[max(0, i-50):i+50]}")
            return

    print(f"Final depth: {depth}")

check_brace_balance('server.ts')
