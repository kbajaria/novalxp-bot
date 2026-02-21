<?php
require_once(__DIR__ . '/../../config.php');

require_login();
require_sesskey();

$question = required_param('q', PARAM_RAW_TRIMMED);
$historyjson = optional_param('history', '[]', PARAM_RAW);

$history = json_decode($historyjson, true);
if (!is_array($history)) {
    $history = [];
}

header('Content-Type: application/json');

if ($question === '') {
    echo json_encode([
        'ok' => false,
        'error' => get_string('invalidrequest', 'local_novalxpbot'),
        'status' => 400,
    ]);
    exit;
}

$result = \local_novalxpbot\service::chat($question, $history);
echo json_encode($result, JSON_UNESCAPED_SLASHES);
