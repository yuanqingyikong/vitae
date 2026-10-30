const store = require('../../utils/store');

function pad2(n) {
    return n < 10 ? '0' + n : '' + n;
}

function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function formatCN(iso) {
    if (!iso) return '';
    const p = iso.split('-');
    return p[0] + ' 年 ' + Number(p[1]) + ' 月 ' + Number(p[2]) + ' 日';
}

Page({
    data: {
        birthDate: '1995-06-15',
        birthLabel: '',
        maxDate: '',
        editing: false,
    },

    onLoad(options) {
        const editing = !!(options && options.edit === '1');
        const profile = store.getProfile();
        const birthDate = profile && profile.birthDate ? profile.birthDate : '1995-06-15';

        this.setData({
            editing: editing,
            birthDate: birthDate,
            birthLabel: formatCN(birthDate),
            maxDate: todayISO(),
        });

        wx.setNavigationBarTitle({ title: editing ? '修改生日' : '此生' });
    },

    onDateChange(event) {
        const value = event.detail.value;
        this.setData({
            birthDate: value,
            birthLabel: formatCN(value),
        });
    },

    onStart() {
        const profile = store.getProfile() || {};
        profile.birthDate = this.data.birthDate;
        if (!profile.createdAt) profile.createdAt = Date.now();
        store.saveProfile(profile);

        if (this.data.editing) {
            wx.navigateBack();
        } else {
            wx.redirectTo({ url: '/pages/index/index' });
        }
    },
});
