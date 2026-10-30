const fs = require('fs');
const path = require('path');

const root = process.argv[2];
let problems = 0;

function fail(msg) {
    problems++;
    console.log('  ! ' + msg);
}

function walk(dir, out) {
    fs.readdirSync(dir).forEach(function (name) {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) walk(full, out);
        else out.push(full);
    });
    return out;
}

// 极简 WXML 解析：只关心元素树、属性和自闭合，够用来查标签闭合与 wx:if 链
function parse(src) {
    const text = src.replace(/<!--[\s\S]*?-->/g, '');
    const tagRe = /<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
    const rootNode = { name: '#root', attrs: {}, children: [] };
    const stack = [rootNode];
    let m;

    while ((m = tagRe.exec(text)) !== null) {
        const closing = m[1] === '/';
        const name = m[2];
        const rawAttrs = m[3] || '';
        const selfClose = m[4] === '/';

        if (closing) {
            const top = stack.pop();
            if (!top || top.name !== name) {
                return { error: '标签不匹配：</' + name + '>' + (top ? '（未闭合的 <' + top.name + '>）' : '') };
            }
            continue;
        }

        const attrs = {};
        const attrRe = /([\w:.-]+)\s*=\s*"([^"]*)"/g;
        let a;
        while ((a = attrRe.exec(rawAttrs)) !== null) attrs[a[1]] = a[2];

        const node = { name: name, attrs: attrs, children: [] };
        stack[stack.length - 1].children.push(node);
        if (!selfClose) stack.push(node);
    }

    if (stack.length > 1) {
        return { error: '未闭合标签：' + stack.slice(1).map(function (n) { return n.name; }).join(', ') };
    }
    return { tree: rootNode };
}

function checkChain(node, file) {
    const kids = node.children;
    for (let i = 0; i < kids.length; i++) {
        const cur = kids[i];
        const hasElse = 'wx:else' in cur.attrs;
        const hasElif = 'wx:elif' in cur.attrs;
        if (hasElse || hasElif) {
            const prev = kids[i - 1];
            const prevOk = prev && ('wx:if' in prev.attrs || 'wx:elif' in prev.attrs);
            if (!prevOk) {
                fail(file + ' <' + cur.name + '> 的 ' + (hasElse ? 'wx:else' : 'wx:elif') + ' 前一个兄弟节点不是 wx:if/wx:elif');
            }
        }
        checkChain(cur, file);
    }
}

// 1. 页面四件套
const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
appJson.pages.forEach(function (p) {
    ['js', 'json', 'wxml', 'wxss'].forEach(function (ext) {
        if (!fs.existsSync(path.join(root, p + '.' + ext))) fail('缺少文件 ' + p + '.' + ext);
    });
});

// 2. 事件绑定必须存在；3. 标签闭合；4. wx:if 链
const BIND = /\b(?:bind|catch)([a-z]+)\s*=\s*"([^"{}]+)"/g;
const wxmls = walk(path.join(root, 'pages'), []).filter(function (f) { return f.endsWith('.wxml'); });

wxmls.forEach(function (wxmlPath) {
    const base = path.basename(wxmlPath);
    const jsPath = wxmlPath.replace(/\.wxml$/, '.js');
    const wxml = fs.readFileSync(wxmlPath, 'utf8');

    if (fs.existsSync(jsPath)) {
        const js = fs.readFileSync(jsPath, 'utf8');
        let m;
        BIND.lastIndex = 0;
        while ((m = BIND.exec(wxml)) !== null) {
            const handler = m[2].trim();
            const declared =
                new RegExp('(^|[\\s{,])' + handler + '\\s*\\(').test(js) ||
                new RegExp('(^|[\\s{,])' + handler + '\\s*:').test(js);
            if (!declared) fail(base + ' 绑定了不存在的方法 ' + handler);
        }
    }

    const parsed = parse(wxml);
    if (parsed.error) {
        fail(base + ' ' + parsed.error);
        return;
    }
    checkChain(parsed.tree, base);
});

console.log(problems === 0 ? '\n全部通过' : '\n共 ' + problems + ' 个问题');
process.exit(problems === 0 ? 0 : 1);
