import os
from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST


def _usuario_permitido(user):
    """
    Si ALLOWED_USERS está definido en .env, solo esos usernames pueden entrar.
    Si no está definido, solo se exige is_staff o is_superuser (comportamiento anterior).

    Ejemplo en .env:
        ALLOWED_USERS=alexis,otrousuario
    """
    allowed_env = os.environ.get('ALLOWED_USERS', '').strip()
    if allowed_env:
        allowed = [u.strip() for u in allowed_env.split(',') if u.strip()]
        if user.username not in allowed:
            return False
    return user.is_staff or user.is_superuser


def login_view(request):
    if request.user.is_authenticated:
        return redirect('gestion:index')

    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')

        user = authenticate(request, username=username, password=password)

        if user is not None:
            if _usuario_permitido(user):
                login(request, user)
                return redirect('gestion:marcadores')
            else:
                messages.error(request, 'No tienes permisos para acceder.')
        else:
            messages.error(request, 'Usuario o contraseña incorrectos.')

    return render(request, 'gestion/login.html')


@login_required(login_url='gestion:login')
@require_POST
def logout_view(request):
    logout(request)
    return redirect('gestion:login')