import os

for root, _, files in os.walk('backend/app'):
    for file in files:
        if file.endswith('.py'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            replaced_content = content.replace('`n', '')
            if replaced_content != content:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(replaced_content)
