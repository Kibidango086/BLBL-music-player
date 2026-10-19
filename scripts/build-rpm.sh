#!/usr/bin/env bash
#
# Builds an RPM from a Linux build of `mygo build`, with the files of the .deb
# it makes beside it: the app in /opt/<name>/, and its desktop entry and icons
# under /usr/share, so both packages install the same thing.
#
#   scripts/build-rpm.sh build/linux-amd64 3.0.0
#
# Needs rpmbuild (Fedora: rpm-build, Debian and Ubuntu: rpm).
set -euo pipefail

dir=${1:?usage: build-rpm.sh <build-dir> <version>}
version=${2:?usage: build-rpm.sh <build-dir> <version>}
dir=$(cd "$dir" && pwd)

case "$(basename "$dir")" in
  *-amd64) rpmarch=x86_64 ;;
  *-arm64) rpmarch=aarch64 ;;
  *) echo "build-rpm: unknown architecture: $(basename "$dir")" >&2; exit 1 ;;
esac

deb=$(find "$dir" -maxdepth 1 -name '*.deb' | head -1)
if [ -z "$deb" ]; then
  echo "build-rpm: no .deb in $dir, which it takes its files from" >&2
  exit 1
fi
if ! command -v rpmbuild >/dev/null; then
  echo "build-rpm: rpmbuild is missing: install rpm-build (Fedora) or rpm (Debian)" >&2
  exit 1
fi

# The payload of the .deb is the tree to package: /opt/<name>, /usr/share/...
stage=$(mktemp -d)
top=$(mktemp -d)
trap 'rm -rf "$stage" "$top"' EXIT
member=$(ar t "$deb" | grep -m1 '^data\.tar' || true)
if [ -z "$member" ]; then
  echo "build-rpm: $deb has no data.tar" >&2
  exit 1
fi
ar p "$deb" "$member" > "$stage/payload"
mkdir -p "$stage/root"
tar -xf "$stage/payload" -C "$stage/root"

name=$(basename "$(find "$stage/root/opt" -mindepth 1 -maxdepth 1 -type d | head -1)")
if [ -z "$name" ]; then
  echo "build-rpm: the .deb installs nothing in /opt" >&2
  exit 1
fi

mkdir -p "$top"/{SPECS,BUILD,RPMS,SRPMS}

cat > "$top/SPECS/$name.spec" <<SPEC
%global debug_package %{nil}
%global __os_install_post %{nil}

Name:           $name
Version:        $version
Release:        1
Summary:        Bilibili as a music player
License:        MIT
URL:            https://github.com/Kibidango086/BLBL-music-player
Requires:       gtk3
Requires:       webkit2gtk4.1
AutoReqProv:    no

%description
把 B 站变成你的音乐库。
BLBL Music Player 以音乐播放器的形式体验 Bilibili 视频内容：搜索、播放列表、
收藏夹、沉浸歌词、深度环绕音，界面由系统的 webview 渲染，本体是单个 Go 程序。

%install
mkdir -p %{buildroot}/opt %{buildroot}/usr/share/applications %{buildroot}/usr/share/icons
cp -a "$stage/root/opt/$name" %{buildroot}/opt/
cp -a "$stage/root/usr/share/applications/$name.desktop" %{buildroot}/usr/share/applications/
cp -a "$stage/root/usr/share/icons/." %{buildroot}/usr/share/icons/

%post
update-desktop-database -q /usr/share/applications 2>/dev/null || :

%postun
update-desktop-database -q /usr/share/applications 2>/dev/null || :

%files
/opt/$name
/usr/share/applications/$name.desktop
/usr/share/icons/hicolor

%changelog
* $(LC_ALL=C date '+%a %b %d %Y') Kibidango086 - $version-1
- BLBL Music Player $version
SPEC

rpmbuild -bb --quiet --target "$rpmarch" --define "_topdir $top" "$top/SPECS/$name.spec"
rpmfile=$(find "$top/RPMS" -name '*.rpm' | head -1)
if [ -z "$rpmfile" ]; then
  echo "build-rpm: rpmbuild made no package" >&2
  exit 1
fi
cp "$rpmfile" "$dir/"
echo "$(basename "$rpmfile")"
