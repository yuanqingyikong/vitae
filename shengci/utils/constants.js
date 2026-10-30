// 业务枚举。集中定义，避免各页面散落中文字面量。
const TYPES = [
    { code: 'milestone', label: '里程碑' },
    { code: 'first', label: '第一次' },
    { code: 'last', label: '最后一次' },
    { code: 'gather', label: '相聚' },
    { code: 'farewell', label: '离别' },
    { code: 'turn', label: '转折' },
    { code: 'daily', label: '日常' }
];

const EMOTIONS = ['平静', '喜悦', '温暖', '遗憾', '难过', '复杂'];

// 精度选项。顺序即录入页的展示顺序：从最精确到最模糊。
const PRECISIONS = [
    { code: 'day', label: '具体某天' },
    { code: 'month', label: '只记得月份' },
    { code: 'year', label: '只记得年份' },
    { code: 'season', label: '只记得季节' },
    { code: 'decade', label: '只记得大概十年' },
    { code: 'unknown', label: '真的记不清了' }
];

function typeLabel(code) {
    for (let i = 0; i < TYPES.length; i++) {
        if (TYPES[i].code === code) return TYPES[i].label;
    }
    return '';
}

module.exports = {
    TYPES: TYPES,
    EMOTIONS: EMOTIONS,
    PRECISIONS: PRECISIONS,
    typeLabel: typeLabel
};
