<?php
defined('MOODLE_INTERNAL') || die();

if ($hassiteconfig) {
    $settings = new admin_settingpage('local_novalxpbot', get_string('pluginname', 'local_novalxpbot'));

    $settings->add(new admin_setting_heading(
        'local_novalxpbot/settingsheading',
        get_string('settingsheading', 'local_novalxpbot'),
        ''
    ));

    $settings->add(new admin_setting_configtext(
        'local_novalxpbot/backendendpoint',
        get_string('backendendpoint', 'local_novalxpbot'),
        get_string('backendendpoint_desc', 'local_novalxpbot'),
        '',
        PARAM_URL
    ));

    $settings->add(new admin_setting_configpasswordunmask(
        'local_novalxpbot/backendapikey',
        get_string('backendapikey', 'local_novalxpbot'),
        get_string('backendapikey_desc', 'local_novalxpbot'),
        ''
    ));

    $settings->add(new admin_setting_configtext(
        'local_novalxpbot/requesttimeout',
        get_string('requesttimeout', 'local_novalxpbot'),
        get_string('requesttimeout_desc', 'local_novalxpbot'),
        20,
        PARAM_INT
    ));

    $ADMIN->add('localplugins', $settings);
}
