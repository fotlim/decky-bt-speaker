"""最小化的 `decky` 桩模块，仅供离线测试导入 `main.py`。

Decky Loader 在真机上会把 `decky` 注入 Python 进程；开发机上没有，
所以 `import main` 会直接失败。这个桩只提供 `main.py` 用到的几个属性。

⚠️ 只用于测试。绝不要把它打进插件包（pack.py 的 skip 列表已排除）。
"""

# 日志接口
class _Logger:
    def info(self, *a, **k):
        pass

    def warning(self, *a, **k):
        pass

    def error(self, *a, **k):
        pass

    def exception(self, *a, **k):
        pass

    def debug(self, *a, **k):
        pass


logger = _Logger()

# 路径常量（用临时目录，避免测试时污染真实目录）
import os as _os
import tempfile as _tempfile

_TMP = _tempfile.mkdtemp(prefix="bt-decky-stub-")
DECKY_PLUGIN_DIR = _TMP
DECKY_PLUGIN_RUNTIME_DIR = _TMP
DECKY_PLUGIN_LOG_DIR = _TMP
DECKY_PLUGIN_SETTINGS_DIR = _TMP
DECKY_USER = "deck"
DECKY_HOME = _TMP

HOME = _TMP
USER = "deck"

# 版本信息
DECKY_VERSION = "0.0.0-test"
