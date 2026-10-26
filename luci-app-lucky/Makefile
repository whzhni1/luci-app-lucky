include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI for lucky
LUCI_DEPENDS:=+luci-base +curl
LUCI_PKGARCH:=all

PKG_NAME:=luci-app-lucky
PKG_VERSION:=2.1.4
PKG_RELEASE:=1
PKG_PO_VERSION:=$(PKG_VERSION)

LUCI_MINIFY_JS:=0
LUCI_MINIFY_CSS:=0

define Build/Prepare/$(PKG_NAME)
	$(SED) "s/^var LUCKY_ASSET_VERSION = '[^']*';/var LUCKY_ASSET_VERSION = '$(PKG_VERSION)-r$(PKG_RELEASE)';/" $(PKG_BUILD_DIR)/htdocs/luci-static/resources/lucky/common.js
endef

include $(TOPDIR)/feeds/luci/luci.mk

define Package/$(PKG_NAME)/conffiles
/etc/config/lucky
endef

define Package/$(PKG_NAME)/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
INITD=/etc/init.d
UPGRADE_MARKER=/tmp/lucky-luci-app-upgrade
if [ "$${PKG_UPGRADE}" = "1" ] || [ -e "$${UPGRADE_MARKER}" ]; then
	rm -f "$${UPGRADE_MARKER}"
else
	/usr/libexec/lucky-package.sh restore >/dev/null 2>&1 || true
	$${INITD}/lucky enable >/dev/null 2>&1 || true
	( setsid "$${INITD}/lucky" start </dev/null >/dev/null 2>&1 & )
fi
$${INITD}/rpcd reload >/dev/null 2>&1 || true
rm -rf /tmp/luci-*
exit 0
endef

define Package/$(PKG_NAME)/prerm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
/usr/libexec/lucky-package.sh uninstall "$$@" >/dev/null 2>&1 || true
rm -rf /tmp/luci-*
exit 0
endef

define Package/$(PKG_NAME)/postrm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
PURGE_LIST=/tmp/lucky-luci-app-purge
[ -f "$${PURGE_LIST}" ] || exit 0
while IFS= read -r path; do
	case "$${path}" in
		/*)
			case "$${path}" in
				/|/etc|/etc/config|/usr|/usr/bin|/usr/sbin|/bin|/sbin|/var|/tmp|/root|/home) continue ;;
				*'/../'*|*'/..'|*'/./'*|*'/.'|*//*|*[!A-Za-z0-9_./-]*) continue ;;
			esac
			rm -rf "$${path}"
			;;
	esac
done < "$${PURGE_LIST}"
rm -f "$${PURGE_LIST}"
/etc/init.d/rpcd reload >/dev/null 2>&1 || true
rm -rf /tmp/luci-*
exit 0
endef

$(eval $(call BuildPackage,$(PKG_NAME)))
