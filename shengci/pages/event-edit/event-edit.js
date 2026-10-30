const store = require('../../utils/store');
const time = require('../../utils/time');
const { TYPES, EMOTIONS, PRECISIONS } = require('../../utils/constants');

const EMOTION_OPTIONS = ['不标注'].concat(EMOTIONS);

function pad2(n) {
    return n < 10 ? '0' + n : '' + n;
}

function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function digits(label) {
    return String(label).replace(/[^\d]/g, '');
}

function currentSeasonIndex() {
    // 3-5 春 / 6-8 夏 / 9-11 秋 / 12-2 冬
    const m = new Date().getMonth() + 1;
    if (m >= 3 && m <= 5) return 0;
    if (m >= 6 && m <= 8) return 1;
    if (m >= 9 && m <= 11) return 2;
    return 3;
}

function buildColumns(precision) {
    const nowYear = new Date().getFullYear();
    const years = [];
    for (let y = nowYear; y >= 1900; y--) years.push(String(y));
    const months = [];
    for (let m = 1; m <= 12; m++) months.push(m + ' 月');
    const seasons = ['春', '夏', '秋', '冬'];
    const decades = [];
    for (let d = Math.floor(nowYear / 10) * 10; d >= 1900; d -= 10) decades.push(d + ' 年代');

    if (precision === 'month') return [years, months];
    if (precision === 'year') return [years];
    if (precision === 'season') return [years, seasons];
    if (precision === 'decade') return [decades];
    return [];
}

function defaultIndexes(precision, columns) {
    const nowMonth = new Date().getMonth();
    if (precision === 'month') return [0, nowMonth];
    if (precision === 'year') return [0];
    if (precision === 'season') return [0, currentSeasonIndex()];
    if (precision === 'decade') return [0];
    return [];
}

function composeValue(precision, columns, indexes, dayValue) {
    if (precision === 'day') return dayValue;
    if (precision === 'unknown') return '';
    if (!columns.length) return '';
    if (precision === 'month') {
        return digits(columns[0][indexes[0]]) + '-' + pad2(Number(digits(columns[1][indexes[1]])));
    }
    if (precision === 'year') return digits(columns[0][indexes[0]]);
    if (precision === 'season') return digits(columns[0][indexes[0]]) + '-S' + (indexes[1] + 1);
    if (precision === 'decade') return digits(columns[0][indexes[0]]);
    return '';
}

Page({
    data: {
        step: 0,
        editingId: '',
        photos: [],
        precision: 'day',
        precisionIndex: 0,
        precisions: PRECISIONS,
        columns: [],
        indexes: [],
        dayValue: '',
        timeValue: '',
        timeLabel: '',
        title: '',
        showMore: false,
        typeIndex: 0,
        types: TYPES.map(function (t) {
            return t.label;
        }),
        emotionOptions: EMOTION_OPTIONS,
        emotionIndex: 0,
        place: '',
        content: '',
        maxPhotos: 9,
    },

    onLoad(options) {
        const today = todayISO();
        const base = {
            dayValue: today,
            timeValue: today,
            timeLabel: time.formatDate('day', today),
        };

        // 1) 编辑既有记录
        if (options && options.id) {
            const event = store.getEvent(options.id);
            if (event) {
                const precisionIndex = Math.max(
                    0,
                    PRECISIONS.findIndex(function (p) {
                        return p.code === event.precision;
                    })
                );
                const columns = buildColumns(event.precision);
                let typeIndex = 0;
                for (let i = 0; i < TYPES.length; i++) {
                    if (TYPES[i].code === event.type) typeIndex = i;
                }
                let emotionIndex = 0;
                if (event.emotion) {
                    const at = EMOTIONS.indexOf(event.emotion);
                    if (at >= 0) emotionIndex = at + 1;
                }

                this.setData({
                    editingId: event.id,
                    photos: event.photos || [],
                    precision: event.precision,
                    precisionIndex: precisionIndex,
                    columns: columns,
                    indexes: defaultIndexes(event.precision, columns),
                    dayValue: event.precision === 'day' ? event.value : today,
                    timeValue: event.value,
                    timeLabel: time.formatDate(event.precision, event.value),
                    title: event.title,
                    typeIndex: typeIndex,
                    emotionIndex: emotionIndex,
                    place: event.place || '',
                    content: event.content || '',
                    showMore: !!(event.place || event.content || event.emotion),
                });
                wx.setNavigationBarTitle({ title: '修改这条' });
                return;
            }
        }

        // 2) 恢复草稿
        if (options && options.draft === '1') {
            const draft = store.getDraft();
            if (draft) {
                this.setData({
                    photos: draft.photos || [],
                    precision: draft.precision || 'day',
                    precisionIndex: draft.precisionIndex || 0,
                    columns: draft.columns || [],
                    indexes: draft.indexes || [],
                    dayValue: draft.dayValue || today,
                    timeValue: draft.timeValue || today,
                    timeLabel: draft.timeLabel || time.formatDate('day', today),
                    title: draft.title || '',
                    typeIndex: draft.typeIndex || 0,
                    emotionIndex: draft.emotionIndex || 0,
                    place: draft.place || '',
                    content: draft.content || '',
                    step: draft.step || 0,
                    showMore: !!draft.showMore,
                });
                return;
            }
        }

        // 3) 从空状态的建议项进入，直接落到第三步写标题
        this.setData(base);
        if (options && options.seed) {
            this.setData({
                title: decodeURIComponent(options.seed),
                step: 2,
            });
        }
    },

    // ---------- 草稿 ----------

    saveDraft() {
        const d = this.data;
        store.saveDraft({
            photos: d.photos,
            precision: d.precision,
            precisionIndex: d.precisionIndex,
            columns: d.columns,
            indexes: d.indexes,
            dayValue: d.dayValue,
            timeValue: d.timeValue,
            timeLabel: d.timeLabel,
            title: d.title,
            typeIndex: d.typeIndex,
            emotionIndex: d.emotionIndex,
            place: d.place,
            content: d.content,
            step: d.step,
            showMore: d.showMore,
        });
    },

    // ---------- 第一步：照片 ----------

    choosePhoto() {
        const remain = this.data.maxPhotos - this.data.photos.length;
        if (remain <= 0) return;

        const append = (paths) => {
            this.setData({ photos: this.data.photos.concat(paths) }, () => {
                this.saveDraft();
            });
        };

        if (wx.chooseMedia) {
            wx.chooseMedia({
                count: remain,
                mediaType: ['image'],
                sizeType: ['compressed'],
                success: (res) => {
                    const paths = res.tempFiles.map(function (f) {
                        return store.persistPhoto(f.tempFilePath);
                    });
                    append(paths);
                },
            });
            return;
        }

        wx.chooseImage({
            count: remain,
            sizeType: ['compressed'],
            success: (res) => {
                const paths = res.tempFilePaths.map(function (p) {
                    return store.persistPhoto(p);
                });
                append(paths);
            },
        });
    },

    previewPhoto(event) {
        wx.previewImage({
            current: event.currentTarget.dataset.src,
            urls: this.data.photos,
        });
    },

    removePhoto(event) {
        const index = Number(event.currentTarget.dataset.index);
        const next = this.data.photos.slice();
        next.splice(index, 1);
        this.setData({ photos: next }, () => {
            this.saveDraft();
        });
    },

    // ---------- 第二步：时间 ----------

    onPrecisionTap(event) {
        const index = Number(event.currentTarget.dataset.index);
        const precision = PRECISIONS[index].code;
        if (precision === this.data.precision) return;

        const columns = buildColumns(precision);
        const indexes = defaultIndexes(precision, columns);
        const timeValue = composeValue(precision, columns, indexes, this.data.dayValue);

        this.setData(
            {
                precisionIndex: index,
                precision: precision,
                columns: columns,
                indexes: indexes,
                timeValue: timeValue,
                timeLabel: time.formatDate(precision, timeValue),
            },
            () => {
                this.saveDraft();
            }
        );
    },

    onDayChange(event) {
        const value = event.detail.value;
        this.setData(
            {
                dayValue: value,
                timeValue: value,
                timeLabel: time.formatDate('day', value),
            },
            () => {
                this.saveDraft();
            }
        );
    },

    onTimeChange(event) {
        const indexes = event.detail.value;
        const timeValue = composeValue(this.data.precision, this.data.columns, indexes, this.data.dayValue);
        this.setData(
            {
                indexes: indexes,
                timeValue: timeValue,
                timeLabel: time.formatDate(this.data.precision, timeValue),
            },
            () => {
                this.saveDraft();
            }
        );
    },

    onColumnChange(event) {
        const indexes = this.data.indexes.slice();
        indexes[event.detail.column] = event.detail.value;
        this.setData({ indexes: indexes });
    },

    // ---------- 第三步：标题与补充 ----------

    onTitleInput(event) {
        this.setData({ title: event.detail.value });
    },

    onTitleBlur() {
        this.saveDraft();
    },

    toggleMore() {
        this.setData({ showMore: !this.data.showMore }, () => {
            this.saveDraft();
        });
    },

    onTypeChange(event) {
        this.setData({ typeIndex: Number(event.detail.value) }, () => {
            this.saveDraft();
        });
    },

    onEmotionChange(event) {
        this.setData({ emotionIndex: Number(event.detail.value) }, () => {
            this.saveDraft();
        });
    },

    onPlaceInput(event) {
        this.setData({ place: event.detail.value });
    },

    onContentInput(event) {
        this.setData({ content: event.detail.value });
    },

    // ---------- 流程 ----------

    goNext() {
        if (this.data.step >= 2) {
            this.onSave();
            return;
        }
        this.setData({ step: this.data.step + 1 }, () => {
            this.saveDraft();
        });
    },

    goPrev() {
        if (this.data.step <= 0) {
            wx.navigateBack();
            return;
        }
        this.setData({ step: this.data.step - 1 }, () => {
            this.saveDraft();
        });
    },

    jumpStep(event) {
        const step = Number(event.currentTarget.dataset.step);
        if (step > this.data.step) return;
        this.setData({ step: step });
    },

    onSave() {
        const title = (this.data.title || '').trim();
        if (!title) {
            wx.showToast({ title: '写一句话当标题', icon: 'none' });
            return;
        }

        const event = {
            id: this.data.editingId || store.uid(),
            title: title,
            precision: this.data.precision,
            value: this.data.timeValue,
            sortKey: time.buildSortKey(this.data.precision, this.data.timeValue),
            type: TYPES[this.data.typeIndex].code,
            emotion: this.data.emotionIndex > 0 ? EMOTIONS[this.data.emotionIndex - 1] : '',
            place: (this.data.place || '').trim(),
            content: (this.data.content || '').trim(),
            photos: this.data.photos,
        };

        store.saveEvent(event);
        store.clearDraft();
        wx.navigateBack();
    },
});
