#!/bin/bash

# 实时翻译工具 - 开发脚本

set -e

echo "🚀 实时语音翻译工具 - 开发工具"
echo "=================================="

# 检查 Docker
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo "❌ Docker 未安装"
        echo "请先安装 Docker Desktop: https://docs.docker.com/desktop/install/mac-install/"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        echo "❌ Docker 未运行"
        echo "请启动 Docker Desktop"
        exit 1
    fi
    
    echo "✅ Docker 环境正常"
}

# 构建所有服务
build_all() {
    echo "🔨 构建所有服务..."
    docker-compose build
    echo "✅ 构建完成"
}

# 启动所有服务
start_all() {
    echo "🚀 启动所有服务..."
    docker-compose up -d
    echo "✅ 服务启动完成"
    echo ""
    echo "📱 前端地址: http://localhost:3000"
    echo "🔧 后端API: http://localhost:8000"
    echo "🎤 Whisper服务: http://localhost:8001"
    echo "🔤 翻译服务: http://localhost:8002"
}

# 停止所有服务
stop_all() {
    echo "🛑 停止所有服务..."
    docker-compose down
    echo "✅ 服务已停止"
}

# 重启所有服务
restart_all() {
    echo "🔄 重启所有服务..."
    stop_all
    start_all
    echo "✅ 服务已重启"
}

# 查看日志
show_logs() {
    echo "📋 显示服务日志..."
    docker-compose logs -f
}

# 清理环境
clean_all() {
    echo "🧹 清理环境..."
    docker-compose down -v
    docker system prune -f
    echo "✅ 清理完成"
}

# 主菜单
show_menu() {
    echo ""
    echo "请选择操作:"
    echo "1) 检查环境"
    echo "2) 构建服务"
    echo "3) 启动服务" 
    echo "4) 停止服务"
    echo "5) 重启服务"
    echo "6) 查看日志"
    echo "7) 清理环境"
    echo "8) 退出"
    echo ""
}

# 主循环
main() {
    while true; do
        show_menu
        read -p "请输入选择 (1-8): " choice
        
        case $choice in
            1) check_docker ; break ;;
            2) build_all ; break ;;
            3) start_all ; break ;;
            4) stop_all ; break ;;
            5) restart_all ; break ;;
            6) docker-compose logs -f ; break ;;
            7) clean_all ; break ;;
            8) echo "👋 再见!"; exit 0 ;;
            *) echo "❌ 无效选择，请重试" ;;
        esac
        
        echo ""
        read -p "按 Enter 继续..."
    done
}

# 如果提供了参数，则直接执行
if [ -n "$1" ]; then
    case $1 in
        check) check_docker ;;
        build) build_all ;;
        start) start_all ;;
        stop) stop_all ;;
        restart) restart_all ;;
        logs) docker-compose logs -f ;;
        clean) clean_all ;;
        *) echo "❌ 无效命令: $1" ;;
    esac
else
    main
fi
